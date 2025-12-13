import { Injectable, Logger } from '@nestjs/common';
import { Client as SSH2Client, ClientChannel } from 'ssh2';
import { ScpClient } from 'node-scp';

@Injectable()
export class PodSshService {
  private readonly logger = new Logger(PodSshService.name);

  async connect(
    host: string,
    port: number,
    username: string,
    password: string,
    maxRetries: number = 5
  ): Promise<SSH2Client> {
    let lastError: Error;

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
            password,
            readyTimeout: 30000,
            keepaliveInterval: 10000
          });
        });
      } catch (error) {
        lastError = error;
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        this.logger.warn(
          `SSH connection attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`
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
    password: string
  ): Promise<void> {
    this.logger.log(`Uploading directory ${localDir} to ${remoteDir}`);

    try {
      const scpClient = await new ScpClient({
        host,
        port,
        username,
        password,
        readyTimeout: 30000
      });

      await scpClient.uploadDir(localDir, remoteDir);
      scpClient.close();

      this.logger.log('Directory upload completed successfully');
    } catch (error) {
      this.logger.error(`Error uploading directory: ${error.message}`, error.stack);
      throw new Error(`Failed to upload directory via SCP: ${error.message}`);
    }
  }

  async executeCommand(
    command: string,
    connection: SSH2Client,
    timeout: number = 300000 // 5 minutes default
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.logger.log(`Executing command: ${command}`);

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command execution timed out after ${timeout}ms`));
      }, timeout);

      connection.exec(command, (err, stream: ClientChannel) => {
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
