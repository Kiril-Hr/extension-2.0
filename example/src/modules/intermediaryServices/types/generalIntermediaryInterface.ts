import {
  FetchFilesInterface,
  RulesIntermediaryInterface,
} from './intermediaryInterfaces';

export interface GeneralIntermediaryInterface {
  rulesIntermediaryService: RulesIntermediaryInterface
  fetchFilesService: FetchFilesInterface
}
