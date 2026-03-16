import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';

export type ConfirmVariant = 'danger' | 'default';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
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

  @ViewChild('confirmBtn') confirmBtn?: ElementRef<HTMLButtonElement>;

  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private lastActive: HTMLElement | null = null;

  ngOnChanges() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.open) {
      this.lastActive = this.document.activeElement as HTMLElement;
      queueMicrotask(() => this.confirmBtn?.nativeElement.focus());
      return;
    }

    queueMicrotask(() => this.lastActive?.focus?.());
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
