import {
  FetchFilesInterface,
  RulesIntermediaryInterface,
} from './types/intermediaryInterfaces';
import { RulesIntermediaryService } from './services/rulesIntermediaryService';
import { GeneralIntermediaryInterface } from './types/generalIntermediaryInterface';
import { FetchFilesService } from './services/fetchFilesService';

class IntermediaryService implements GeneralIntermediaryInterface {

  constructor(
    public rulesIntermediaryService: RulesIntermediaryInterface = new RulesIntermediaryService(),
    public fetchFilesService: FetchFilesInterface = new FetchFilesService(),
  ) {
    Object.freeze(this.rulesIntermediaryService);
    Object.freeze(this.fetchFilesService);
  }
}

const GeneralIntermediary = new IntermediaryService()

export default GeneralIntermediary
