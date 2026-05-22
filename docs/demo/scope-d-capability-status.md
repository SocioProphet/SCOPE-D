# SCOPE-D Capability Status Product Surface

Status: product-facing D-capability overview  
Runtime posture: reporting only  

## Purpose

SCOPE-D starts from capability. The operator should be able to ask what the product can do, what is gated, what is blocked, what evidence is required, and what the next safe promotion is.

This surface exposes the six D-capability classes as product state rather than buried implementation detail.

## Command

```bash
node scripts/scope-d.js capability:status
```

## Capabilities surfaced

- live target action
- network access
- credential access
- payload delivery
- mutation
- destructive behavior

## Product boundary

The command reports capability status only. It does not authorize or perform live behavior.

Credential access, payload delivery, mutation, and destructive behavior are visible as capability classes, but they are not executable through this command.

Capability recognition is not authorization.

## Operator value

The capability report answers:

- What can SCOPE-D do now?
- What is gated?
- What is blocked?
- What evidence is required?
- What is the next safe promotion path?

This is the product-facing entry point for D-capability governance.