import { Component } from '@angular/core';
import {HeroSlider} from "../../../shared/ui/hero-slider/hero-slider";

@Component({
  selector: 'app-home-page',
    imports: [
        HeroSlider
    ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {

}
