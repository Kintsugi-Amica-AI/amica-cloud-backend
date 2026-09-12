import { onRequest } from "firebase-functions/v2/https";

export { onJourneyUpdated } from "./triggers/onJourneyUpdated";
export { onSosAlertCreated } from "./triggers/onSosAlertCreated";
export { onVehicleReviewCreated } from "./triggers/onVehicleReviewCreated";
export { onVehicleSafetyEventCreated } from "./triggers/onVehicleSafetyEventCreated";

export const healthCheck = onRequest((_request, response) => {
  response.json({
    service: "amica-cloud-backend",
    status: "ok",
  });
});
