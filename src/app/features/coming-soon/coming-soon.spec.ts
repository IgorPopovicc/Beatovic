import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ComingSoonComponent } from './coming-soon';

describe('ComingSoonComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComingSoonComponent],
      providers: [provideHttpClient(), provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('renders the branded announcement content', () => {
    const fixture = TestBed.createComponent(ComingSoonComponent);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain('USKORO');
    expect(page.querySelector('h1')?.textContent).toContain('LIVE');
    expect(page.querySelector('.intro')?.textContent).toContain('Nova online prodavnica');
    expect(page.querySelector('.stay-tuned')?.textContent).toContain('STAY TUNED');
    expect(page.querySelector('.brand__logo')?.getAttribute('alt')).toBe('PlanetSport');
  });
});
