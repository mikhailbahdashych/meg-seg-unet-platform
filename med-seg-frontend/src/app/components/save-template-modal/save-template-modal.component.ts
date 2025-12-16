import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-save-template-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './save-template-modal.component.html',
  styleUrls: ['./save-template-modal.component.scss']
})
export class SaveTemplateModalComponent {
  @Input() show = false;
  @Input() templateName = '';
  @Input() templateDescription = '';
  @Input() saving = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ name: string; description: string }>();
  @Output() templateNameChange = new EventEmitter<string>();
  @Output() templateDescriptionChange = new EventEmitter<string>();

  onClose(): void {
    if (!this.saving) {
      this.close.emit();
    }
  }

  onSave(): void {
    if (!this.templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    this.save.emit({
      name: this.templateName.trim(),
      description: this.templateDescription.trim()
    });
  }

  onTemplateNameChange(value: string): void {
    this.templateNameChange.emit(value);
  }

  onTemplateDescriptionChange(value: string): void {
    this.templateDescriptionChange.emit(value);
  }
}
