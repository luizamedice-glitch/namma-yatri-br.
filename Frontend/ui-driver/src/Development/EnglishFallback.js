// SPDX-License-Identifier: AGPL-3.0-or-later
import {getEn as original} from '../../output/Resource.Localizable.EN/index.js?br-driver-original-locale';
import {enabled} from './Driver.js';
// First operational dashboard terminology; untouched keys retain the original catalog.
const dashboard = {
  go_online:'Ficar disponível', go_offline:'Ficar indisponível', online_:'Disponível', offline:'Indisponível',
  you_are_offline:'Você está indisponível', go_online_prompt:'Você está indisponível.\nFique disponível para receber solicitações.',
  go_online_popup:'<u>Ficar disponível</u>', go_home:'Ir para o início',
  going_offline_will_not_get_you_any_ride:'Enquanto estiver indisponível, você não receberá solicitações.',
  you_are_currently_busy_go_online_to_recieve_trip_requests:'Fique disponível para receber solicitações de viagem.',
  you_are_on_a_ride:'Você está em uma viagem...', driver_details:'Dados do motorista',
  help:'Ajuda', cancel:'Cancelar', continue:'Continuar', settings:'Configurações',
  yes:'Sim', no:'Não', profile:'Perfil', total_rides:'Total de viagens', total_earnings:'Ganhos totais',
  setting_you_offline:'Alterando para indisponível', ride_requests:'Solicitações de viagem'
};
export const getEn = enabled() ? Object.fromEntries(Object.entries(original).map(([key,value]) =>
  [key, typeof value === 'string' && Object.prototype.hasOwnProperty.call(dashboard,key) ? dashboard[key] : value])) : original;
