import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';

export type ConfirmVariant = 'danger' | 'default';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  @Input({ required: true }) open = false;

  @Input() title = 'Potvrda';
  @Input({ required: true }) message = '';
  @Input() confirmText = 'Da';
  @Input() cancelText = 'Ne';
  @Input() variant: ConfirmVariant = 'default';

  @Input() closeOnBackdrop = true;
  @Input() closeOnEsc = true;
  @Input() busy = false;
  @Input() icon: string | null = null;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private lastActive: HTMLElement | null = null;

  ngOnChanges() {
    if (this.open) {
      this.lastActive = document.activeElement as HTMLElement;
      queueMicrotask(() => {
        const btn = document.querySelector<HTMLElement>('.cd-confirm');
        btn?.focus?.();
      });
    } else {
      queueMicrotask(() => this.lastActive?.focus?.());
    }
  }

  onBackdropClick() {
    if (!this.closeOnBackdrop || this.busy) return;
    this.cancel.emit();
  }

  onCancel() {
    if (this.busy) return;
    this.cancel.emit();
  }

  onConfirm() {
    if (this.busy) return;
    this.confirm.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.open) return;
    if (e.key === 'Escape' && this.closeOnEsc && !this.busy) {
      e.preventDefault();
      this.cancel.emit();
    }
  }
}
