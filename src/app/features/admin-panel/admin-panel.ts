import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss',
})
export class AdminPanel {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly username = computed(() => this.auth.username() ?? 'admin');
  readonly isAdmin = computed(() => this.auth.isAdmin());

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/admin');
  }
}
