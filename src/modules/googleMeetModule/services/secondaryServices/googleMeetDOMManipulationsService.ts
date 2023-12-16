import {
  GoogleMeetDOMManipulationsInterface,
  GoogleMeetUtilsInterface
} from "../../types/googleMeetInterfaces";
import {GoogleMeetUtilsService} from "./googleMeetUtilsService";
import { ServiceDecorator } from '../../../../core/decorators/ServiceDecorator';
import dependencyContainer from '../../../../core/dependencyContainer/dependencyContainer';

@ServiceDecorator
export class GoogleMeetDOMManipulationsService implements GoogleMeetDOMManipulationsInterface {
  private readonly outerControllerID = 'outer-controller-camera'
  private readonly outerStyles = {
    position: 'absolute',
    top: 0,
    left: 0,
    ['z-index']: 1000,
  }
  private readonly conditionParams = {
    isCameraHandleRunning: false
  }

  constructor(
    public UtilsService: GoogleMeetUtilsInterface = dependencyContainer.getService(GoogleMeetUtilsService.name),
  ) {}

  public manageSubtitles = () => {
    const subtitles: HTMLDivElement = document.querySelector('[jsaction="TpIHXe:c0270d;v2nhid:YHhXNc;kDAVge:lUFH9b;Z1rKi:s4fYDc;OoZzdf:s4fYDc"]')
    if (subtitles) {
      // const sharedScreen = document.querySelectorAll('.tTdl5d')[0]
      // const mainScreenBlock: HTMLDivElement = document.querySelector('[jsaction="rcuQ6b:NCu6M; contextmenu:gg8MLb;z5KiKd:qIXZdc;EnKPre:eGjA6d"]')
      //
      // subtitles.style.position = 'absolute'
      // subtitles.style.top = window.getComputedStyle(sharedScreen).top
      // mainScreenBlock.style.height += subtitles.style.height
      return true
    }
      return false
  }

  public disableCamera = async (belowSectionWithBtnExtMeet) => {
      let isCameraOff = false

      const centerBlock = belowSectionWithBtnExtMeet?.querySelector('[jsname="vNB5le"]')
      const camera = centerBlock?.querySelector('div').children[1]
      const cameraBtn: HTMLButtonElement = camera?.querySelector('span button')

      const cameraUI = cameraBtn?.querySelectorAll('div')[2]

      const className = cameraUI?.getAttribute('class')
      const isCameraOn = className?.includes('HotEze')

      if (isCameraOn) {
        this.UtilsService.delay(() => cameraBtn.click(), 0)
        this.UtilsService.delay(() => cameraBtn.disabled = true, 0)
        isCameraOff = true
        this.UtilsService.delay(() => this.outerTurningOverCameraBtn(cameraBtn), 0)
        this.UtilsService.delay(() => this.turnOnOffCameraHandle(cameraBtn), 0)
      }

      return { isCameraOff, cameraUI, cameraBtn }
  }

  public controlBlockTranslationShow(id: string): void {
    const block = document.querySelector(`#${id}`) as HTMLDivElement
    block.style.cssText = `z-index: 1002; opacity: 1; transition: 1s ease-in-out; position: absolute;`;
  }

  public controlBlockTranslationHide(id: string): void {
    const block = document.querySelector(`#${id}`) as HTMLDivElement
    block.style.cssText = `z-index: -1; opacity: 0; transition: 1s ease-in-out; position: absolute;`;
  }

  public createRecordButton(belowBlockBtnExtMeeting: Element) {
    const recordButton = document.createElement('button');
    recordButton.setAttribute('id', 'record-button');

    (belowBlockBtnExtMeeting.childNodes[1] as HTMLDivElement)?.querySelector('div')?.prepend(recordButton);

    recordButton.setAttribute('class', 'VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ tWDL4c uaILN');
    recordButton.style.cssText = 'display: flex; align-items: center; justify-content: center;';

    const span = document.createElement('span');
    span.style.cssText = 'display: block; width: 8px; height: 8px; background: red; border: 1px solid rgba(255,0,0,0.8); border-radius: 50%;';
    recordButton.appendChild(span);

    return recordButton
  }

  public turnOnOffCameraHandle = (cameraBtn: HTMLButtonElement) => {
    if (this.conditionParams.isCameraHandleRunning) return

    this.conditionParams.isCameraHandleRunning = true
    const outer: HTMLElement = document.querySelector(`#${this.outerControllerID}`)

    cameraBtn && this.UtilsService.handleManyClick(outer, 3,async () => {
      this.UtilsService.delay(() => cameraBtn.disabled = false, 0)
      this.UtilsService.delay(() => cameraBtn.click(), 0)
      this.UtilsService.delay(() => cameraBtn.disabled = true, 0)
    })

    this.UtilsService.delay(() => this.conditionParams.isCameraHandleRunning = false, 100)
  }

  private outerTurningOverCameraBtn = (cameraBtn: HTMLButtonElement) => {
      const outer: HTMLElement = document.querySelector(`#${this.outerControllerID}`)
      if (outer) return

      const cameraStyle = window.getComputedStyle(cameraBtn)
      const size = {
        width: cameraStyle.getPropertyValue('width'),
        height: cameraStyle.getPropertyValue('height')
      }

      const styles = Object.assign(this.outerStyles, size)

      const template = document.createElement('div')
      template.id = this.outerControllerID
      template.style.cssText = this.UtilsService.stylesHandle(styles)

      cameraBtn.style.position = 'relative'
      cameraBtn.appendChild(template)
  }

}
