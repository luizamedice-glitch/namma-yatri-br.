-- SPDX-License-Identifier: AGPL-3.0-or-later
module Development.Booking (start) where
import Prelude
import Effect.Unsafe (unsafePerformEffect)
import Control.Monad.Except.Trans (lift)
import Components.PrimaryButton.Controller as PrimaryButton
import Development.PilotTrip as Trip
import Development.Rides as Rides
import Development.GeoAttribution as GeoAttribution
import Engineering.Helpers.Utils (showToast)
import PrestoDOM
import PrestoDOM.Core.Types.Language.Flow (runScreen)
import PrestoDOM.Types.Core (class Loggable)
import Types.App (FlowBT)

data Action = NoOp | TripUpdated Trip.Trip | RideError String | RequestRide PrimaryButton.Action | CancelRide PrimaryButton.Action | ReturnBooking PrimaryButton.Action
instance showAction :: Show Action where
  show _ = ""
instance logAction :: Loggable Action where
  performLog _ _ = pure unit

start :: Rides.Point -> Rides.Point -> FlowBT String Unit
start origin destination = do
  _ <- lift $ lift $ runScreen
    {initialState: Trip.emptyTrip, name: "BrBooking"
    ,globalEvents: [\push -> Rides.subscribe
        origin destination
        (push <<< TripUpdated) (push <<< RideError)]
    ,view: \push trip -> linearLayout [width MATCH_PARENT,height MATCH_PARENT,orientation VERTICAL,background "#FFFFFF",onBackPressed push (const $ ReturnBooking PrimaryButton.OnClick)]
       [Trip.heading (case trip.phase of
          "quoted" -> "Estimativa da viagem"
          "requesting" -> "Confirmando solicitação…"
          "searching" -> "Procurando motorista"
          "accepted" -> "Motorista a caminho"
          "arrived" -> "Motorista no embarque"
          "in_progress" -> "Viagem em andamento"
          "completed" -> "Viagem concluída"
          "cancelled" -> "Viagem cancelada"
          "error" -> "Não foi possível calcular a viagem"
          _ -> "Calculando estimativa…")
       ,Trip.mapView
       ,Trip.card push NoOp trip
       ,GeoAttribution.view
       ,textView [text trip.tracking,textSize 14,padding (Padding 20 0 20 8),color "#666666"]
       ,textView [text trip.driver,textSize 20,padding (Padding 20 8 20 8),color "#242424"]
       ,textView [text trip.vehicle,textSize 16,padding (Padding 20 0 20 12),color "#666666"]
       ,linearLayout [width MATCH_PARENT,height WRAP_CONTENT,visibility (if trip.phase=="quoted" then VISIBLE else GONE)]
          [Trip.button (push <<< RequestRide) "Solicitar viagem" true]
       ,linearLayout [width MATCH_PARENT,height WRAP_CONTENT,visibility (if trip.phase=="searching" || trip.phase=="accepted" || trip.phase=="arrived" then VISIBLE else GONE)]
          [Trip.button (push <<< CancelRide) "Cancelar viagem" true]
       ,Trip.button (push <<< ReturnBooking) "Voltar ao início" true]
    ,eval: \action trip -> case action of
       TripUpdated updated -> continue updated
       RideError message -> do
         _ <- pure $ unsafePerformEffect $ showToast message
         continue (if trip.phase=="idle" then trip {phase="error"} else trip)
       RequestRide PrimaryButton.OnClick -> do
         _ <- pure $ unsafePerformEffect Rides.request
         continue trip
       CancelRide PrimaryButton.OnClick -> do
         _ <- pure $ unsafePerformEffect Rides.cancel
         continue trip
       ReturnBooking PrimaryButton.OnClick -> do
         _ <- pure $ unsafePerformEffect $ when (trip.phase=="completed" || trip.phase=="cancelled") Rides.dismiss
         exit unit
       _ -> continue trip
    }
  pure unit

