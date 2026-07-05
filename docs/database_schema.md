# Database Schema

## users

Stores profile metadata for authenticated users.

- `displayName`
- `email`
- `phoneNumber`
- `createdAt`
- `updatedAt`

## emergency_contacts

Trusted contacts linked to a user.

- `userId`
- `name`
- `phoneNumber`
- `relationship`
- `createdAt`

## journeys

Smart Journey Timer state.

- `userId`
- `destination`
- `status`
- `startedAt`
- `expectedArrivalAt`
- `completedAt`

## sos_alerts

Emergency alerts created by manual, timer, or stealth voice triggers.

- `userId`
- `triggerType`
- `status`
- `location`
- `createdAt`

## vehicles

Prototype vehicle status records for Scan Before You Ride.

- `plateNumber`
- `status`
- `notes`
- `updatedAt`
