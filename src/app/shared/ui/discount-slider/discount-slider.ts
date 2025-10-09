import { Component } from '@angular/core';
import {ProductCardComponent} from '../product-card/product-card';

@Component({
  selector: 'app-discount-slider',
  imports: [
    ProductCardComponent
  ],
  templateUrl: './discount-slider.html',
  styleUrl: './discount-slider.scss'
})
export class DiscountSlider {

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
