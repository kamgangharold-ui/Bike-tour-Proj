export const GEOFENCE_RADIUS_METRES = 40;
// A landmark counts as "visited" once the rider comes within this radius (looser
// than the 40 m arrival geofence, which is too tight to reliably trip at cycling
// speed / GPS jitter — that's why "seen" counts stayed 0). FIX 19.
export const VISITED_RADIUS_METRES = 100;
export const FINE_SIDEWALK_EUR = 500;
export const FINE_EARPHONES_EUR = 100;
export const DISMOUNT_ZONE_CATEGORY = 'dismount_zone';
export const BARCELONA_CENTER = { latitude: 41.3851, longitude: 2.1734 };
export const BICIBOX_URL =
  'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search?resource_id=bicicletes_estacions_bicibox&limit=200';
export const BICIPARK_URL =
  'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search?resource_id=aparcaments-bicicletes&limit=200';
