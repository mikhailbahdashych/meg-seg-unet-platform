import torch
import torch.nn as nn
from typing import List, Tuple, Optional


class ConfigurableConvBlock(nn.Module):
    """Configurable convolution block with customizable parameters"""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: int = 3,
        num_convs: int = 2,
        use_batch_norm: bool = True,
        activation: str = 'relu',
        dropout_rate: float = 0.0
    ):
        super(ConfigurableConvBlock, self).__init__()

        layers = []
        current_channels = in_channels

        for i in range(num_convs):
            # Calculate padding to maintain spatial dimensions
            padding = (kernel_size - 1) // 2

            # Convolution layer
            layers.append(nn.Conv2d(
                current_channels,
                out_channels,
                kernel_size=kernel_size,
                padding=padding,
                bias=not use_batch_norm
            ))

            # Batch normalization
            if use_batch_norm:
                layers.append(nn.BatchNorm2d(out_channels))

            # Activation function
            if activation == 'relu':
                layers.append(nn.ReLU(inplace=True))
            elif activation == 'leaky_relu':
                layers.append(nn.LeakyReLU(0.2, inplace=True))
            elif activation == 'elu':
                layers.append(nn.ELU(inplace=True))
            elif activation == 'selu':
                layers.append(nn.SELU(inplace=True))

            # Dropout
            if dropout_rate > 0:
                layers.append(nn.Dropout2d(dropout_rate))

            current_channels = out_channels

        self.block = nn.Sequential(*layers)

    def forward(self, x):
        return self.block(x)


class ConfigurableDownBlock(nn.Module):
    """Configurable downsampling block"""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        pooling_type: str = 'max',
        pooling_size: int = 2,
        kernel_size: int = 3,
        num_convs: int = 2,
        use_batch_norm: bool = True,
        activation: str = 'relu',
        dropout_rate: float = 0.0
    ):
        super(ConfigurableDownBlock, self).__init__()

        # Pooling layer
        if pooling_type == 'max':
            self.pool = nn.MaxPool2d(pooling_size)
        elif pooling_type == 'avg':
            self.pool = nn.AvgPool2d(pooling_size)
        elif pooling_type == 'strided_conv':
            self.pool = nn.Conv2d(
                in_channels,
                in_channels,
                kernel_size=pooling_size,
                stride=pooling_size
            )
        else:
            raise ValueError(f"Unknown pooling type: {pooling_type}")

        # Convolution block
        self.conv_block = ConfigurableConvBlock(
            in_channels,
            out_channels,
            kernel_size,
            num_convs,
            use_batch_norm,
            activation,
            dropout_rate
        )

    def forward(self, x):
        x = self.pool(x)
        x = self.conv_block(x)
        return x


class ConfigurableUpBlock(nn.Module):
    """Configurable upsampling block"""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        upsampling_type: str = 'transpose',
        upsampling_size: int = 2,
        kernel_size: int = 3,
        num_convs: int = 2,
        use_batch_norm: bool = True,
        activation: str = 'relu',
        dropout_rate: float = 0.0,
        skip_connection: bool = True
    ):
        super(ConfigurableUpBlock, self).__init__()

        self.skip_connection = skip_connection

        # Upsampling layer
        if upsampling_type == 'transpose':
            self.up = nn.ConvTranspose2d(
                in_channels,
                in_channels // 2,
                kernel_size=upsampling_size,
                stride=upsampling_size
            )
        elif upsampling_type == 'bilinear':
            self.up = nn.Sequential(
                nn.Upsample(scale_factor=upsampling_size, mode='bilinear', align_corners=True),
                nn.Conv2d(in_channels, in_channels // 2, kernel_size=1)
            )
        elif upsampling_type == 'nearest':
            self.up = nn.Sequential(
                nn.Upsample(scale_factor=upsampling_size, mode='nearest'),
                nn.Conv2d(in_channels, in_channels // 2, kernel_size=1)
            )
        else:
            raise ValueError(f"Unknown upsampling type: {upsampling_type}")

        # Convolution block (input channels doubled if using skip connections)
        conv_in_channels = in_channels if skip_connection else in_channels // 2
        self.conv_block = ConfigurableConvBlock(
            conv_in_channels,
            out_channels,
            kernel_size,
            num_convs,
            use_batch_norm,
            activation,
            dropout_rate
        )

    def forward(self, x, skip=None):
        x = self.up(x)

        if self.skip_connection and skip is not None:
            # Handle potential size mismatch
            diffY = skip.size()[2] - x.size()[2]
            diffX = skip.size()[3] - x.size()[3]

            x = nn.functional.pad(x, [
                diffX // 2, diffX - diffX // 2,
                diffY // 2, diffY - diffY // 2
            ])

            # Concatenate along channel dimension
            x = torch.cat([skip, x], dim=1)

        x = self.conv_block(x)
        return x


class ConfigurableUNet(nn.Module):
    """
    Fully configurable U-Net architecture for medical image segmentation.

    Args:
        in_channels (int): Number of input channels
        out_channels (int): Number of output channels
        base_filters (int): Number of filters in the first layer
        depth (int): Number of encoder/decoder stages
        kernel_size (int): Size of convolution kernels
        num_convs_per_block (int): Number of convolutions per block
        pooling_type (str): Type of pooling ('max', 'avg', 'strided_conv')
        pooling_size (int): Size of pooling operation
        upsampling_type (str): Type of upsampling ('transpose', 'bilinear', 'nearest')
        upsampling_size (int): Size of upsampling operation
        use_batch_norm (bool): Whether to use batch normalization
        activation (str): Activation function ('relu', 'leaky_relu', 'elu', 'selu')
        dropout_rate (float): Dropout rate (0.0 means no dropout)
        skip_connections (bool): Whether to use skip connections
        filter_multiplier (int): Multiplier for filters at each stage (default: 2)
    """

    def __init__(
        self,
        in_channels: int = 3,
        out_channels: int = 1,
        base_filters: int = 64,
        depth: int = 4,
        kernel_size: int = 3,
        num_convs_per_block: int = 2,
        pooling_type: str = 'max',
        pooling_size: int = 2,
        upsampling_type: str = 'transpose',
        upsampling_size: int = 2,
        use_batch_norm: bool = True,
        activation: str = 'relu',
        dropout_rate: float = 0.0,
        skip_connections: bool = True,
        filter_multiplier: int = 2
    ):
        super(ConfigurableUNet, self).__init__()

        self.in_channels = in_channels
        self.out_channels = out_channels
        self.depth = depth
        self.skip_connections = skip_connections

        # Initial convolution block
        self.inc = ConfigurableConvBlock(
            in_channels,
            base_filters,
            kernel_size,
            num_convs_per_block,
            use_batch_norm,
            activation,
            dropout_rate
        )

        # Encoder (downsampling path)
        self.down_blocks = nn.ModuleList()
        current_filters = base_filters

        for i in range(depth):
            next_filters = current_filters * filter_multiplier
            self.down_blocks.append(
                ConfigurableDownBlock(
                    current_filters,
                    next_filters,
                    pooling_type,
                    pooling_size,
                    kernel_size,
                    num_convs_per_block,
                    use_batch_norm,
                    activation,
                    dropout_rate
                )
            )
            current_filters = next_filters

        # Decoder (upsampling path)
        self.up_blocks = nn.ModuleList()

        for i in range(depth):
            next_filters = current_filters // filter_multiplier
            self.up_blocks.append(
                ConfigurableUpBlock(
                    current_filters,
                    next_filters,
                    upsampling_type,
                    upsampling_size,
                    kernel_size,
                    num_convs_per_block,
                    use_batch_norm,
                    activation,
                    dropout_rate,
                    skip_connections
                )
            )
            current_filters = next_filters

        # Output convolution
        self.outc = nn.Conv2d(base_filters, out_channels, kernel_size=1)

    def forward(self, x):
        # Encoder
        x1 = self.inc(x)
        encoder_features = [x1]

        x = x1
        for down in self.down_blocks:
            x = down(x)
            encoder_features.append(x)

        # Decoder
        for i, up in enumerate(self.up_blocks):
            if self.skip_connections:
                skip_feature = encoder_features[-(i + 2)]
                x = up(x, skip_feature)
            else:
                x = up(x, None)

        # Output
        logits = self.outc(x)
        return logits

    def get_config(self):
        """Return model configuration for saving/loading"""
        # Extract configuration from the first blocks
        first_down = self.down_blocks[0] if len(self.down_blocks) > 0 else None
        first_up = self.up_blocks[0] if len(self.up_blocks) > 0 else None

        return {
            'in_channels': self.in_channels,
            'out_channels': self.out_channels,
            'depth': self.depth,
            'skip_connections': self.skip_connections,
            # Note: Other params would need to be stored separately or inferred
        }


def create_configurable_unet(config: dict):
    """
    Factory function to create a configurable U-Net model from a configuration dict.

    Args:
        config (dict): Configuration dictionary containing model parameters

    Returns:
        ConfigurableUNet: Configured U-Net model
    """
    return ConfigurableUNet(
        in_channels=config.get('in_channels', 3),
        out_channels=config.get('out_channels', 1),
        base_filters=config.get('base_filters', 64),
        depth=config.get('depth', 4),
        kernel_size=config.get('kernel_size', 3),
        num_convs_per_block=config.get('num_convs_per_block', 2),
        pooling_type=config.get('pooling_type', 'max'),
        pooling_size=config.get('pooling_size', 2),
        upsampling_type=config.get('upsampling_type', 'transpose'),
        upsampling_size=config.get('upsampling_size', 2),
        use_batch_norm=config.get('use_batch_norm', True),
        activation=config.get('activation', 'relu'),
        dropout_rate=config.get('dropout_rate', 0.0),
        skip_connections=config.get('skip_connections', True),
        filter_multiplier=config.get('filter_multiplier', 2)
    )


if __name__ == '__main__':
    # Test the configurable model
    print("Testing ConfigurableUNet...")

    # Standard configuration
    standard_config = {
        'in_channels': 3,
        'out_channels': 1,
        'base_filters': 64,
        'depth': 4,
        'kernel_size': 3,
        'num_convs_per_block': 2,
        'pooling_type': 'max',
        'pooling_size': 2,
        'upsampling_type': 'transpose',
        'upsampling_size': 2,
        'use_batch_norm': True,
        'activation': 'relu',
        'dropout_rate': 0.0,
        'skip_connections': True,
        'filter_multiplier': 2
    }

    model = create_configurable_unet(standard_config)

    # Test with dummy input
    x = torch.randn(1, 3, 256, 256)
    output = model(x)

    print(f"Input shape: {x.shape}")
    print(f"Output shape: {output.shape}")

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")

    # Test custom configuration
    print("\n" + "="*60)
    print("Testing custom configuration...")

    custom_config = {
        'in_channels': 1,
        'out_channels': 1,
        'base_filters': 32,
        'depth': 3,
        'kernel_size': 5,
        'num_convs_per_block': 3,
        'pooling_type': 'avg',
        'pooling_size': 2,
        'upsampling_type': 'bilinear',
        'upsampling_size': 2,
        'use_batch_norm': True,
        'activation': 'leaky_relu',
        'dropout_rate': 0.2,
        'skip_connections': True,
        'filter_multiplier': 2
    }

    custom_model = create_configurable_unet(custom_config)

    x_custom = torch.randn(1, 1, 256, 256)
    output_custom = custom_model(x_custom)

    print(f"Custom Input shape: {x_custom.shape}")
    print(f"Custom Output shape: {output_custom.shape}")

    custom_params = sum(p.numel() for p in custom_model.parameters())
    print(f"Custom model parameters: {custom_params:,}")

    print("\nAll tests passed!")
