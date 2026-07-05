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

## Local development

```bash
cd functions
npm install
npm test
```

Configure real Firebase projects locally through Firebase CLI aliases and environment-specific settings outside version control.
