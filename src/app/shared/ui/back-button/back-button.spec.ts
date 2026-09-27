import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BackNavigationService } from '../../../core/navigation/back-navigation.service';
import { BackButtonComponent } from './back-button';

describe('BackButtonComponent', () => {
  it('exposes a named native button, suppresses duplicate clicks and hides without a destination', () => {
    const pending = signal(false);
    const available = signal(true);
    const back = jasmine.createSpy('back');
    TestBed.configureTestingModule({
      imports: [BackButtonComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: BackNavigationService,
          useValue: {
            pending,
            canNavigate: () => available(),
            back,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BackButtonComponent);
    fixture.componentRef.setInput('fallback', '/cart');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toContain('Nazad');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    button.click();
    expect(back).toHaveBeenCalledOnceWith('/cart');

    pending.set(true);
    fixture.detectChanges();
    button.click();
    expect(button.disabled).toBeTrue();
    expect(back).toHaveBeenCalledTimes(1);
    pending.set(false);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();

    available.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
