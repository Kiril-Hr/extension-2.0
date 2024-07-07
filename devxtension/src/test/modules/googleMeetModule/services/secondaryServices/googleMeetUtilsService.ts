import { GoogleMeetUtilsInterface } from "../../types/googleMeetInterfaces";
import {ServiceDecorator} from "../../../../../core";

// @ts-ignore
@ServiceDecorator
export class GoogleMeetUtilsService implements GoogleMeetUtilsInterface {

    constructor() {}

    public convertTimeWithZero = (time: Date) => `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

    public leadToGeneral = (name: string) => name.replace(/(\n.*|\([^)]*\)|^\s+)/g, '')

    public leadsNotLeads = (list) => {
      const leads = []
      const notLeads = []

      for (let i = 0; i < list.length; i++) {
        list[i].participantRole === 'lead'
          ? leads.push(list[i].participantName)
          : notLeads.push(list[i].participantName)
      }

      return {
        leads,
        notLeads
      }
    }

    public myRole = (exitConfigList) => {
      if (!exitConfigList) return console.warn('Don\'t save in exitConfigList !')
      const participants = document.querySelectorAll('.dkjMxf')
      const me = participants[participants.length - 1]
      const myName = (me.querySelector('.XEazBc span div') as HTMLDivElement).outerText

      const isGuest = exitConfigList.filter((p) => p.participantName === myName)

      return isGuest.length === 0 ? 'participant' : isGuest[0].participantRole
    }

    public clickAndWait = async(element, delay) => {
      element.click();
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    public delay = (executeFn, delay) => {
      return setTimeout(() => {
        executeFn()
      }, delay)
    }

    public onSubtitles = async (settingsMenu: HTMLElement) => {
      const settingsMenuButton = settingsMenu.querySelector('button')
      await this.clickAndWait(settingsMenuButton, 0);

      const settingsWindow = document.querySelector('[jsname="dq27Te"]');
      await this.clickAndWait(settingsWindow, 2000);

      const subtitlesOptions = document.querySelectorAll('[jsname="IDf7eb"]');
      const subtitlesOption = subtitlesOptions[subtitlesOptions.length - 2].querySelector('span button')
      await this.clickAndWait(subtitlesOption, 200);

      const checkBox = document.querySelector('[jsname="BfMHN"]');
      await this.clickAndWait(checkBox, 0);

      const close = document.querySelector('.VfPpkd-Bz112c-LgbsSe.yHy1rc.eT1oJ.mN1ivc.VfPpkd-zMU9ub');
      await this.clickAndWait(close, 0);
    }

    public handleManyClick = (element: HTMLElement, clickQty: number, func: Function): boolean => {
      let throttle = false
      element.addEventListener('click', function (e) {
        if (!throttle && e.detail === clickQty) {
          throttle = true
          func()
          setTimeout(function () {
            throttle = false
            element.removeEventListener('click', this)
          }, 100);
        }
      })

      return throttle
    }

    public stylesHandle = (styles: Record<string, string | number>) =>
      Object.entries(styles).reduce((string, style) =>
        string + `${style[0]}: ${style[1]}; `, '')

}
