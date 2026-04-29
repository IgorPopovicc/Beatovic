import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminContact } from './admin-contact';

describe('AdminContact', () => {
  let component: AdminContact;
  let fixture: ComponentFixture<AdminContact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminContact],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminContact);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
