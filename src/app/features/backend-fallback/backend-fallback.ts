import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-backend-fallback',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './backend-fallback.html',
  styleUrl: './backend-fallback.scss',
})
export class BackendFallbackComponent {
  @Output() retry = new EventEmitter<void>();
}
