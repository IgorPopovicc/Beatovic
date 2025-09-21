import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewCollection } from './new-collection';

describe('NewCollection', () => {
  let component: NewCollection;
  let fixture: ComponentFixture<NewCollection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCollection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewCollection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
