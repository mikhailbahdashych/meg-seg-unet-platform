import torch
import torch.nn as nn
import torch.nn.functional as F


class DiceLoss(nn.Module):
    """
    Dice Loss for binary segmentation.
    The Dice coefficient is a common metric for image segmentation tasks.
    """

    def __init__(self, smooth=1.0):
        super(DiceLoss, self).__init__()
        self.smooth = smooth

    def forward(self, predictions, targets):
        """
        Args:
            predictions: Tensor of shape (N, C, H, W) - logits from the model
            targets: Tensor of shape (N, C, H, W) - ground truth masks

        Returns:
            Dice loss value
        """
        # Apply sigmoid to get probabilities
        predictions = torch.sigmoid(predictions)

        # Flatten the tensors
        predictions = predictions.view(-1)
        targets = targets.view(-1)

        # Calculate intersection and union
        intersection = (predictions * targets).sum()
        dice_coeff = (2. * intersection + self.smooth) / (
            predictions.sum() + targets.sum() + self.smooth
        )

        # Return Dice loss (1 - Dice coefficient)
        return 1 - dice_coeff


class FocalLoss(nn.Module):
    """
    Focal Loss for addressing class imbalance.
    Focuses training on hard examples by down-weighting easy examples.
    """

    def __init__(self, alpha=0.25, gamma=2.0):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, predictions, targets):
        """
        Args:
            predictions: Tensor of shape (N, C, H, W) - logits from the model
            targets: Tensor of shape (N, C, H, W) - ground truth masks

        Returns:
            Focal loss value
        """
        # Apply sigmoid to get probabilities
        predictions = torch.sigmoid(predictions)

        # Flatten the tensors
        predictions = predictions.view(-1)
        targets = targets.view(-1)

        # Calculate binary cross entropy
        bce_loss = F.binary_cross_entropy(predictions, targets, reduction='none')

        # Calculate focal term: (1 - p_t)^gamma
        p_t = predictions * targets + (1 - predictions) * (1 - targets)
        focal_term = (1 - p_t) ** self.gamma

        # Calculate focal loss
        focal_loss = self.alpha * focal_term * bce_loss

        return focal_loss.mean()


class CombinedLoss(nn.Module):
    """
    Combined loss: Weighted combination of Dice Loss and BCE Loss.
    This combines the benefits of both losses for better segmentation.
    """

    def __init__(self, dice_weight=0.5, bce_weight=0.5, smooth=1.0):
        super(CombinedLoss, self).__init__()
        self.dice_weight = dice_weight
        self.bce_weight = bce_weight
        self.dice_loss = DiceLoss(smooth=smooth)
        self.bce_loss = nn.BCEWithLogitsLoss()

    def forward(self, predictions, targets):
        """
        Args:
            predictions: Tensor of shape (N, C, H, W) - logits from the model
            targets: Tensor of shape (N, C, H, W) - ground truth masks

        Returns:
            Combined loss value
        """
        dice = self.dice_loss(predictions, targets)
        bce = self.bce_loss(predictions, targets)

        return self.dice_weight * dice + self.bce_weight * bce


def get_loss_function(loss_name, **kwargs):
    """
    Factory function to get loss function by name.

    Args:
        loss_name (str): Name of the loss function ('dice', 'bce', 'focal', 'combined')
        **kwargs: Additional arguments for the loss function

    Returns:
        Loss function instance
    """
    loss_functions = {
        'dice': DiceLoss,
        'bce': nn.BCEWithLogitsLoss,
        'focal': FocalLoss,
        'combined': CombinedLoss
    }

    if loss_name not in loss_functions:
        raise ValueError(
            f"Unknown loss function: {loss_name}. "
            f"Available options: {list(loss_functions.keys())}"
        )

    loss_class = loss_functions[loss_name]

    # BCEWithLogitsLoss doesn't need extra args
    if loss_name == 'bce':
        return loss_class()

    return loss_class(**kwargs)


if __name__ == '__main__':
    # Test loss functions
    print("Testing loss functions...")

    # Create dummy data
    batch_size = 2
    channels = 1
    height, width = 256, 256

    predictions = torch.randn(batch_size, channels, height, width)
    targets = torch.randint(0, 2, (batch_size, channels, height, width)).float()

    # Test Dice Loss
    dice_loss = DiceLoss()
    dice_value = dice_loss(predictions, targets)
    print(f"Dice Loss: {dice_value.item():.4f}")

    # Test BCE Loss
    bce_loss = nn.BCEWithLogitsLoss()
    bce_value = bce_loss(predictions, targets)
    print(f"BCE Loss: {bce_value.item():.4f}")

    # Test Focal Loss
    focal_loss = FocalLoss(alpha=0.25, gamma=2.0)
    focal_value = focal_loss(predictions, targets)
    print(f"Focal Loss: {focal_value.item():.4f}")

    # Test Combined Loss
    combined_loss = CombinedLoss(dice_weight=0.5, bce_weight=0.5)
    combined_value = combined_loss(predictions, targets)
    print(f"Combined Loss: {combined_value.item():.4f}")

    print("\nAll loss functions working correctly!")
