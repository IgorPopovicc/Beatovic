import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroSlider } from './hero-slider';

describe('HeroSlider', () => {
  let component: HeroSlider;
  let fixture: ComponentFixture<HeroSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSlider]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeroSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
