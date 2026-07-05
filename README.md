# Amica Cloud Backend

Firebase backend scaffolding for Amica safety workflows.

## Scope

- Firestore rules and indexes
- Cloud Functions written in TypeScript
- Seed data for prototype development
- Documentation for collections and safety flows
- Basic GitHub Actions validation

No Firebase credentials or service account keys are committed to this repository.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the Amica branch strategy, issue workflow, commit expectations, pull request process, and CI/CD guidance.

## Deployment Strategy

- `dev` branch is used for development integration.
- Backend `dev` branch deploys to Firebase development project only.
- `main` branch is reserved for final demo/production-ready code.
- Production deployment is not automatic yet.
- Mobile app produces APK artifacts through GitHub Actions.
- AI repo produces test/artifact outputs only.

## Local development

```bash
cd functions
npm install
npm test
```

Configure real Firebase projects locally through Firebase CLI aliases and environment-specific settings outside version control.
