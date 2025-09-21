import { Component } from '@angular/core';
import {HeroSlider} from "../../../shared/ui/hero-slider/hero-slider";
import {BrandsSlider} from '../../../shared/ui/brands-slider/brands-slider';
import {NewCollection} from '../../../shared/ui/new-collection/new-collection';

@Component({
  selector: 'app-home-page',
  imports: [
    HeroSlider,
    BrandsSlider,
    NewCollection
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {

}
