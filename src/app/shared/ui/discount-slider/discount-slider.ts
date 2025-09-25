import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {ProductCardComponent} from '../product-card/product-card';

@Component({
  selector: 'app-discount-slider',
  imports: [
    ProductCardComponent
  ],
  templateUrl: './discount-slider.html',
  styleUrl: './discount-slider.scss'
})
export class DiscountSlider implements AfterViewInit, OnDestroy {

  @ViewChild('scroller', { static: true }) scroller!: ElementRef<HTMLDivElement>;

  private dragging = false;
  private moved = false;
  private startX = 0;
  private startScroll = 0;
  private THRESHOLD = 6;

  private cleanup?: () => void;

  ngAfterViewInit() {
    const el = this.scroller.nativeElement;

    const onDown = (e: PointerEvent) => {
      this.dragging = true;
      this.moved = false;
      this.startX = e.clientX;
      this.startScroll = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.classList.add('grabbing');
    };

    const onMove = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.startX;
      if (Math.abs(dx) > this.THRESHOLD) this.moved = true;
      el.scrollLeft = this.startScroll - dx;
    };

    const onUp = (e: PointerEvent) => {
      this.dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch {}
      el.classList.remove('grabbing');
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    const onClickCapture = (ev: Event) => {
      if (this.moved) {
        ev.preventDefault();
        ev.stopPropagation();
        queueMicrotask(() => (this.moved = false));
      }
    };
    el.addEventListener('click', onClickCapture, true);

    this.cleanup = () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }

  ngOnDestroy() { this.cleanup?.(); }

  products = [{
    "id":"1",
    "slug":"kappa-patike-marlon",
    "name":"KAPPA PATIKE LOGO MARLON",
    "subtitle":"Koža/tekstil, plava boja",
    "price":3499,
    "currency":"RSD",
    "image":{
      "desktop":"assets/images/products/test.webp",
      "mobile":"assets/images/products/test.webp",
      "w":960,"h":1280,
      "alt":"Kappa Patike Marlon, plave, muške"
    },
  },
    {
      "id":"2",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "oldPrice":5499,
      "currency":"RSD",
      "discountLabel":"36%",
      "image":{
        "desktop":"assets/images/products/test7.webp",
        "mobile":"assets/images/products/test7.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      }
    },{
      "id":"3",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE LOGO MARLON",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "currency":"RSD",
      "image":{
        "desktop":"assets/images/products/test3.webp",
        "mobile":"assets/images/products/test3.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      },
    },
    {
      "id":"4",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "oldPrice":5499,
      "currency":"RSD",
      "discountLabel":"36%",
      "image":{
        "desktop":"assets/images/products/test4.webp",
        "mobile":"assets/images/products/test4.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      }
    },{
      "id":"5",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE LOGO MARLON",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "currency":"RSD",
      "image":{
        "desktop":"assets/images/products/test5.webp",
        "mobile":"assets/images/products/test5.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      },
    },
    {
      "id":"6",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "oldPrice":5499,
      "currency":"RSD",
      "discountLabel":"36%",
      "image":{
        "desktop":"assets/images/products/test6.webp",
        "mobile":"assets/images/products/test6.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      }
    },{
      "id":"7",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE LOGO MARLON",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "currency":"RSD",
      "image":{
        "desktop":"assets/images/products/test.webp",
        "mobile":"assets/images/products/test.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      },
    },
    {
      "id":"8",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "oldPrice":5499,
      "currency":"RSD",
      "discountLabel":"36%",
      "image":{
        "desktop":"assets/images/products/test.webp",
        "mobile":"assets/images/products/test.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      }
    },
    {
      "id":"9",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE LOGO MARLON",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "currency":"RSD",
      "image":{
        "desktop":"assets/images/products/test.webp",
        "mobile":"assets/images/products/test.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      },
    },
    {
      "id":"10",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "oldPrice":5499,
      "currency":"RSD",
      "discountLabel":"36%",
      "image":{
        "desktop":"assets/images/products/test.webp",
        "mobile":"assets/images/products/test.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      }
    },
    {
      "id":"11",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE LOGO MARLON",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "currency":"RSD",
      "image":{
        "desktop":"assets/images/products/test.webp",
        "mobile":"assets/images/products/test.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      },
    },
    {
      "id":"12",
      "slug":"kappa-patike-marlon",
      "name":"KAPPA PATIKE",
      "subtitle":"Koža/tekstil, plava boja",
      "price":3499,
      "oldPrice":5499,
      "currency":"RSD",
      "discountLabel":"36%",
      "image":{
        "desktop":"assets/images/products/test.webp",
        "mobile":"assets/images/products/test.webp",
        "w":960,"h":1280,
        "alt":"Kappa Patike Marlon, plave, muške"
      }
    }];
}
