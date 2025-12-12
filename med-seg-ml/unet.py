import torch
import torch.nn as nn


class DoubleConv(nn.Module):
    """Double convolution block: (Conv2d -> BatchNorm -> ReLU) * 2"""

    def __init__(self, in_channels, out_channels):
        super(DoubleConv, self).__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        return self.double_conv(x)


class Down(nn.Module):
    """Downscaling block: MaxPool -> DoubleConv"""

    def __init__(self, in_channels, out_channels):
        super(Down, self).__init__()
        self.maxpool_conv = nn.Sequential(
            nn.MaxPool2d(2),
            DoubleConv(in_channels, out_channels)
        )

    def forward(self, x):
        return self.maxpool_conv(x)


class Up(nn.Module):
    """Upscaling block: ConvTranspose2d -> Concatenate with skip connection -> DoubleConv"""

    def __init__(self, in_channels, out_channels):
        super(Up, self).__init__()
        self.up = nn.ConvTranspose2d(in_channels, in_channels // 2, kernel_size=2, stride=2)
        self.conv = DoubleConv(in_channels, out_channels)

    def forward(self, x1, x2):
        x1 = self.up(x1)

        # Handle potential size mismatch due to padding
        diffY = x2.size()[2] - x1.size()[2]
        diffX = x2.size()[3] - x1.size()[3]

        x1 = nn.functional.pad(x1, [diffX // 2, diffX - diffX // 2,
                                     diffY // 2, diffY - diffY // 2])

        # Concatenate along channel dimension
        x = torch.cat([x2, x1], dim=1)
        return self.conv(x)


class OutConv(nn.Module):
    """Output convolution block: 1x1 Conv to map to desired output channels"""

    def __init__(self, in_channels, out_channels):
        super(OutConv, self).__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=1)

    def forward(self, x):
        return self.conv(x)


class UNet(nn.Module):
    """
    U-Net architecture for medical image segmentation.

    Args:
        in_channels (int): Number of input channels (e.g., 3 for RGB, 1 for grayscale)
        out_channels (int): Number of output channels (e.g., 1 for binary segmentation)
        base_filters (int): Number of filters in the first layer (doubles at each down step)
        depth (int): Number of down/up sampling stages (default: 4)
    """

    def __init__(self, in_channels=3, out_channels=1, base_filters=64, depth=4):
        super(UNet, self).__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.base_filters = base_filters
        self.depth = depth

        # Initial convolution
        self.inc = DoubleConv(in_channels, base_filters)

        # Encoder (downsampling path)
        self.down_blocks = nn.ModuleList()
        current_filters = base_filters
        for i in range(depth):
            self.down_blocks.append(Down(current_filters, current_filters * 2))
            current_filters *= 2

        # Decoder (upsampling path)
        self.up_blocks = nn.ModuleList()
        for i in range(depth):
            self.up_blocks.append(Up(current_filters, current_filters // 2))
            current_filters //= 2

        # Output convolution
        self.outc = OutConv(base_filters, out_channels)

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
            skip_connection = encoder_features[-(i + 2)]
            x = up(x, skip_connection)

        # Output
        logits = self.outc(x)
        return logits

    def get_config(self):
        """Return model configuration for saving/loading"""
        return {
            'in_channels': self.in_channels,
            'out_channels': self.out_channels,
            'base_filters': self.base_filters,
            'depth': self.depth
        }


def create_unet(in_channels=3, out_channels=1, base_filters=64, depth=4):
    """
    Factory function to create a U-Net model.

    Args:
        in_channels (int): Number of input channels
        out_channels (int): Number of output channels
        base_filters (int): Number of base filters
        depth (int): Network depth

    Returns:
        UNet: Configured U-Net model
    """
    return UNet(
        in_channels=in_channels,
        out_channels=out_channels,
        base_filters=base_filters,
        depth=depth
    )


if __name__ == '__main__':
    # Test the model
    model = create_unet(in_channels=3, out_channels=1, base_filters=64, depth=4)

    # Test with dummy input
    x = torch.randn(1, 3, 256, 256)
    output = model(x)

    print(f"Input shape: {x.shape}")
    print(f"Output shape: {output.shape}")
    print(f"Model config: {model.get_config()}")

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")
