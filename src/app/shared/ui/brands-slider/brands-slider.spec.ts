import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandsSlider } from './brands-slider';

describe('BrandsSlider', () => {
  let component: BrandsSlider;
  let fixture: ComponentFixture<BrandsSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandsSlider]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrandsSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
