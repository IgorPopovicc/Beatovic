import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscountSlider } from './discount-slider';

describe('DiscountSlider', () => {
  let component: DiscountSlider;
  let fixture: ComponentFixture<DiscountSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscountSlider]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiscountSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
