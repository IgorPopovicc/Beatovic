import {Component, OnDestroy, OnInit, signal, effect, inject, Injector} from '@angular/core';
import { NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

type Slide = {
  alt: string;
  desktop: string;
  desktopW: number;
  desktopH: number;
  mobile: string;
};

@Component({
  selector: 'app-hero-slider',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './hero-slider.html',
  styleUrl: './hero-slider.scss'
})
export class HeroSlider
  implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  private autoRestart = effect(() => {
    this.index();
    if (!this.paused()) {
      this.restartTimer();
    }
  }, { injector: this.injector });

  slides: Slide[] = [
    { alt: 'Poklon popust 2000 RSD', desktop: 'assets/images/banner/banner.webp', desktopW: 1920, desktopH: 600, mobile: 'assets/images/banner/banner-mobile.jpg' },
    { alt: 'Nova kolekcija',         desktop: 'assets/images/banner/banner.webp', desktopW: 1920, desktopH: 600, mobile: 'assets/images/banner/banner-mobile.jpg' },
    { alt: 'Popusti do 50%',         desktop: 'assets/images/banner/banner.webp', desktopW: 1920, desktopH: 600, mobile: 'assets/images/banner/banner-mobile.jpg' },
  ];

  index = signal(0);
  paused = signal(false);
  private timerId: any = null;
  intervalMs = 10000; // 10s

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.startTimer();
    }
  }

  ngOnDestroy(): void { this.clearTimer(); }

  prev() { this.index.set((this.index() + this.slides.length - 1) % this.slides.length); }
  next() { this.index.set((this.index() + 1) % this.slides.length); }
  go(i: number) { this.index.set(i); }

  pause()  { this.paused.set(true);  this.clearTimer(); }
  resume() { this.paused.set(false); this.startTimer(); }

  private startTimer() {
    if (this.timerId) return;
    this.timerId = setInterval(() => this.next(), this.intervalMs);
  }
  private restartTimer() { this.clearTimer(); this.startTimer(); }
  private clearTimer() { if (this.timerId) { clearInterval(this.timerId); this.timerId = null; } }
}
