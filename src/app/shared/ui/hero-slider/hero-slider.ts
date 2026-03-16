import { Component, OnDestroy, OnInit, signal, effect, inject, Injector } from '@angular/core';
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
  styleUrl: './hero-slider.scss',
})
export class HeroSlider implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  private autoRestart = effect(
    () => {
      this.index();
      if (!this.paused()) {
        this.restartTimer();
      }
    },
    { injector: this.injector },
  );

  slides: Slide[] = [
    {
      alt: 'Trčanje i lifestyle modeli za novu sezonu',
      desktop: 'assets/images/home/hero-slide-1.jpg',
      desktopW: 1920,
      desktopH: 860,
      mobile: 'assets/images/home/hero-slide-1-mobile.jpg',
    },
    {
      alt: 'Nova kolekcija patika za svaki dan',
      desktop: 'assets/images/home/hero-slide-2.jpg',
      desktopW: 1920,
      desktopH: 860,
      mobile: 'assets/images/home/hero-slide-2-mobile.jpg',
    },
    {
      alt: 'Trening i performanse bez kompromisa',
      desktop: 'assets/images/home/hero-slide-3.jpg',
      desktopW: 1920,
      desktopH: 860,
      mobile: 'assets/images/home/hero-slide-3-mobile.jpg',
    },
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

  ngOnDestroy(): void {
    this.clearTimer();
  }

  prev() {
    this.index.set((this.index() + this.slides.length - 1) % this.slides.length);
  }
  next() {
    this.index.set((this.index() + 1) % this.slides.length);
  }
  go(i: number) {
    this.index.set(i);
  }

  pause() {
    this.paused.set(true);
    this.clearTimer();
  }
  resume() {
    this.paused.set(false);
    this.startTimer();
  }

  private startTimer() {
    if (this.timerId) return;
    this.timerId = setInterval(() => this.next(), this.intervalMs);
  }
  private restartTimer() {
    this.clearTimer();
    this.startTimer();
  }
  private clearTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
