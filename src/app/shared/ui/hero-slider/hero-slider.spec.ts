import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroSlider } from './hero-slider';

describe('HeroSlider', () => {
  let component: HeroSlider;
  let fixture: ComponentFixture<HeroSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [HeroSlider],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSlider);
    const host = fixture.nativeElement as HTMLElement;
    host.style.width = '1440px';
    host.style.height = '620px';
    document.body.appendChild(host);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  it('should create', async () => {
    expect(component).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
});
