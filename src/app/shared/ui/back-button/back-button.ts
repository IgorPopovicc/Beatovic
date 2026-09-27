import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { BackNavigationService } from '../../../core/navigation/back-navigation.service';

@Component({
  selector: 'app-back-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './back-button.html',
  styleUrl: './back-button.scss',
})
export class BackButtonComponent {
  protected readonly navigation = inject(BackNavigationService);
  readonly fallback = input<string | null>('/products');
  readonly disabled = input(false);
}
