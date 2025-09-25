import { Component } from '@angular/core';
import {ProductCardComponent} from '../product-card/product-card';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-new-collection',
  imports: [
    ProductCardComponent,
    RouterLink
  ],
  templateUrl: './new-collection.html',
  styleUrl: './new-collection.scss'
})
export class NewCollection {
  products = [{
    "id":"sku123",
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
      "id":"sku124",
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
    }];
}
