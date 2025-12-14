import { Injectable, Logger } from '@nestjs/common';
import { Client as SSH2Client, ClientChannel } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class PodSshService {
  private readonly logger = new Logger(PodSshService.name);

  /**
   * Get SSH private key path for RunPod authentication
   * RunPod uses pod host ID to identify the SSH key
   */
  private getSshKeyPath(podHostId: string): string {
    // Default RunPod SSH key location
    const homeDir = os.homedir();
    const defaultKeyPath = path.join(homeDir, '.ssh', 'id_ed25519');

    // RunPod-specific key path (if using pod host ID)
    const runpodKeyPath = path.join(homeDir, '.ssh', `runpod-${podHostId}`);

    // Check if RunPod-specific key exists
    if (fs.existsSync(runpodKeyPath)) {
      this.logger.log(`Using RunPod-specific SSH key: ${runpodKeyPath}`);
      return runpodKeyPath;
    }

    // Fall back to default key
    if (fs.existsSync(defaultKeyPath)) {
      this.logger.log(`Using default SSH key: ${defaultKeyPath}`);
      return defaultKeyPath;
    }

    // Try id_rsa as well
    const rsaKeyPath = path.join(homeDir, '.ssh', 'id_rsa');
    if (fs.existsSync(rsaKeyPath)) {
      this.logger.log(`Using RSA SSH key: ${rsaKeyPath}`);
      return rsaKeyPath;
    }

    throw new Error(
      `No SSH private key found. Tried: ${runpodKeyPath}, ${defaultKeyPath}, ${rsaKeyPath}`
    );
  }

  async connect(
    host: string,
    port: number,
    username: string,
    podHostId: string,
    maxRetries: number = 5
  ): Promise<SSH2Client> {
    let lastError: Error;
    const privateKeyPath = this.getSshKeyPath(podHostId);
    const privateKey = fs.readFileSync(privateKeyPath);

    this.logger.log(`Connecting to ${username}@${host}:${port} using key auth`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const conn = new SSH2Client();

        return await new Promise((resolve, reject) => {
          conn.on('ready', () => {
            this.logger.log(`SSH connection established to ${host}:${port}`);
            resolve(conn);
          });

          conn.on('error', (err) => {
            reject(err);
          });

          conn.connect({
            host,
            port,
            username,
            privateKey,
            readyTimeout: 30000,
            keepaliveInterval: 10000
          });
        });
      } catch (error) {
        lastError = error;
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        this.logger.warn(
          `SSH connection attempt ${attempt + 1}/${maxRetries} failed: ${error.message}, retrying in ${waitTime}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw new Error(
      `Failed to connect via SSH after ${maxRetries} attempts: ${lastError!.message}`
    );
  }

  async uploadDirectory(
    localDir: string,
    remoteDir: string,
    host: string,
    port: number,
    username: string,
    podHostId: string
  ): Promise<void> {
    this.logger.log(
      `Uploading directory ${localDir} to ${username}@${host}:${port}:${remoteDir}`
    );

    try {
      const privateKeyPath = this.getSshKeyPath(podHostId);
      this.logger.log(`Using SSH key: ${privateKeyPath}`);

      // Use native scp command for better compatibility with RunPod
      // Upload directory contents: localDir/* into remoteDir/
      // scp -i ~/.ssh/id_ed25519 -P 15593 -r /local/dir/* root@149.36.1.167:/root/target/
      const scpCommand = `scp -i "${privateKeyPath}" -P ${port} -r -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${localDir}"/* ${username}@${host}:${remoteDir}/`;

      this.logger.log(
        `Executing SCP command: scp -i ${privateKeyPath} -P ${port} -r ${username}@${host}:${remoteDir}/`
      );

      const { execSync } = require('child_process');

      const result = execSync(scpCommand, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000 // 5 minute timeout
      });

      this.logger.log('Directory upload completed successfully');
      if (result) {
        this.logger.debug(`SCP output: ${result}`);
      }
    } catch (error) {
      this.logger.error(`Error uploading directory: ${error.message}`, error.stack);
      if (error.stderr) {
        this.logger.error(`SCP stderr: ${error.stderr}`);
      }
      if (error.stdout) {
        this.logger.debug(`SCP stdout: ${error.stdout}`);
      }
      throw new Error(`Failed to upload directory via SCP: ${error.message}`);
    }
  }

  async executeCommand(
    command: string,
    connection: SSH2Client,
    timeout: number = 300000 // 5 minutes default
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.logger.log(`Executing command: ${command}`);

    // Wrap command in bash login shell to ensure PATH is set correctly
    // This ensures UV and other tools are available
    const wrappedCommand = `/bin/bash -l -c '${command.replace(/'/g, "'\\''")}'`;
    this.logger.debug(`Wrapped command: ${wrappedCommand}`);

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command execution timed out after ${timeout}ms`));
      }, timeout);

      connection.exec(wrappedCommand, (err, stream: ClientChannel) => {
        if (err) {
          clearTimeout(timeoutHandle);
          reject(err);
          return;
        }

        stream.on('close', (code: number) => {
          clearTimeout(timeoutHandle);
          exitCode = code;
          this.logger.log(`Command completed with exit code: ${code}`);
          resolve({ stdout, stderr, exitCode });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });
  }

  async readRemoteFile(remotePath: string, connection: SSH2Client): Promise<string> {
    this.logger.log(`Reading remote file: ${remotePath}`);

    try {
      const result = await this.executeCommand(`cat ${remotePath}`, connection);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${result.stderr}`);
      }

      return result.stdout;
    } catch (error) {
      this.logger.error(`Error reading remote file: ${error.message}`, error.stack);
      throw new Error(`Failed to read remote file: ${error.message}`);
    }
  }

  async disconnect(connection: SSH2Client): Promise<void> {
    connection.end();
    this.logger.log('SSH connection closed');
  }
}
