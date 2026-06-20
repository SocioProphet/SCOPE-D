#!/usr/bin/env python3
"""EngagementPolicy gate enforcer for SCOPE-D OSINT passive lookups.

Every passive lookup must pass this gate before any external contact is made.
This is the control primitive from the OSIRIS recovery backlog (§3 Required
control primitives). Rejects: missing policy, missing scope, unauthorized
target, fixture bypass attempts, non-public target without authorization.

See: docs/osiris-recon-capability-recovery-backlog.md
     config/schemas/osint-passive-lookup.schema.json
"""
import ipaddress
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class DenialReason(str, Enum):
    NO_ENGAGEMENT_POLICY      = "denied_no_policy"
    NO_TARGET_SCOPE           = "denied_no_scope"
    NO_AUTHORIZATION_REF      = "denied_no_authorization_ref"
    NO_OPERATOR_IDENTITY      = "denied_no_operator_identity"
    UNAUTHORIZED_TARGET       = "denied_unauthorized_target"
    PRIVATE_TARGET            = "denied_private_target"
    STEALTH_SEMANTICS         = "denied_stealth_semantics"
    DESTRUCTIVE_MODE          = "denied_destructive_mode"
    NO_RECEIPT_SINK           = "denied_no_receipt_sink"
    UNAUTHORIZED_LOOKUP_TYPE  = "denied_unauthorized_lookup_type"


BLOCKED_LOOKUP_TYPES = {"scanner_proxy", "cidr_sweep", "active_scan", "port_scan", "exploit"}

PRIVATE_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

ALLOWED_EXECUTION_MODES = {"fixture", "passive_public_source", "dry_run"}

ALLOWED_LOOKUP_TYPES = {"dns", "whois", "certs", "bgp", "mac_vendor"}


@dataclass
class EngagementRequest:
    lookup_type: str
    target: str
    target_scope: str
    engagement_policy_ref: str
    authorization_ref: str
    execution_mode: str
    operator_identity_ref: str
    receipt_sink: str
    fixture_mode: bool = False
    stealth_mode: bool = False
    non_destructive_only: bool = True
    additional_flags: dict = field(default_factory=dict)


@dataclass
class GateDecision:
    authorized: bool
    denial_reason: Optional[DenialReason] = None
    denial_message: str = ""
    warnings: list = field(default_factory=list)

    def to_record(self) -> dict:
        return {
            "authorized": self.authorized,
            "denial_reason": self.denial_reason.value if self.denial_reason else None,
            "denial_message": self.denial_message,
            "warnings": self.warnings,
        }


def _is_private_ip(target: str) -> bool:
    try:
        addr = ipaddress.ip_address(target)
        return any(addr in net for net in PRIVATE_IP_RANGES)
    except ValueError:
        return False


def check_engagement_policy(req: EngagementRequest) -> GateDecision:
    """Enforce all EngagementPolicy gates before any external contact.

    Returns GateDecision(authorized=False) with a reason for any violation.
    Returns GateDecision(authorized=True) only when all gates pass.
    """
    # Gate 1: EngagementPolicy reference required
    if not req.engagement_policy_ref or req.engagement_policy_ref.strip() == "":
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.NO_ENGAGEMENT_POLICY,
            denial_message="No EngagementPolicy reference provided. All OSINT lookups require an explicit policy ref.",
        )

    # Gate 2: TargetScope required
    if not req.target_scope or req.target_scope.strip() == "":
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.NO_TARGET_SCOPE,
            denial_message="No TargetScope provided. Declare target scope before any lookup.",
        )

    # Gate 3: AuthorizationRef required
    if not req.authorization_ref or req.authorization_ref.strip() == "":
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.NO_AUTHORIZATION_REF,
            denial_message="No AuthorizationRef provided. Every lookup requires an explicit authorization reference.",
        )

    # Gate 4: OperatorIdentity required
    if not req.operator_identity_ref or req.operator_identity_ref.strip() == "":
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.NO_OPERATOR_IDENTITY,
            denial_message="No OperatorIdentityRef provided. Lookups must be attributed to an authorized operator.",
        )

    # Gate 5: Receipt sink required
    if not req.receipt_sink or req.receipt_sink.strip() == "":
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.NO_RECEIPT_SINK,
            denial_message="No receipt sink provided. All lookups must emit a receipt.",
        )

    # Gate 6: Blocked lookup types
    if req.lookup_type in BLOCKED_LOOKUP_TYPES:
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.UNAUTHORIZED_LOOKUP_TYPE,
            denial_message=f"Lookup type '{req.lookup_type}' is permanently blocked. See docs/osiris-scanner-sweep-quarantine.md.",
        )

    # Gate 7: Unknown lookup type
    if req.lookup_type not in ALLOWED_LOOKUP_TYPES and not req.fixture_mode:
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.UNAUTHORIZED_LOOKUP_TYPE,
            denial_message=f"Lookup type '{req.lookup_type}' is not in the allowed set: {sorted(ALLOWED_LOOKUP_TYPES)}.",
        )

    # Gate 8: Stealth semantics permanently blocked
    if req.stealth_mode or req.additional_flags.get("stealth") or req.additional_flags.get("evasion"):
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.STEALTH_SEMANTICS,
            denial_message="Stealth/evasion semantics are permanently blocked per OSIRIS quarantine boundary. See docs/osiris-scanner-sweep-quarantine.md §5.",
        )

    # Gate 9: NonDestructiveOnly must be true
    if not req.non_destructive_only:
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.DESTRUCTIVE_MODE,
            denial_message="NonDestructiveOnly must be true for all passive lookups.",
        )

    # Gate 10: Execution mode must be in allowed set
    if req.execution_mode not in ALLOWED_EXECUTION_MODES:
        return GateDecision(
            authorized=False,
            denial_reason=DenialReason.DESTRUCTIVE_MODE,
            denial_message=f"Execution mode '{req.execution_mode}' is not allowed. Must be one of: {sorted(ALLOWED_EXECUTION_MODES)}.",
        )

    # Gate 11: Private/internal targets blocked unless explicitly scoped
    if _is_private_ip(req.target):
        if req.target_scope not in ("owned_infrastructure", "authorized_by_engagement_policy"):
            return GateDecision(
                authorized=False,
                denial_reason=DenialReason.PRIVATE_TARGET,
                denial_message=f"Private/internal IP target '{req.target}' requires target_scope 'owned_infrastructure' or 'authorized_by_engagement_policy', got '{req.target_scope}'.",
            )

    # Gate 12: fixture_only scope means no live external contact
    warnings = []
    if req.target_scope == "fixture_only" and req.execution_mode != "fixture":
        warnings.append(
            f"target_scope is 'fixture_only' but execution_mode is '{req.execution_mode}'. "
            "No live external contact will be made — result will be fixture data only."
        )

    return GateDecision(authorized=True, warnings=warnings)


def build_denial_record(req: EngagementRequest, decision: GateDecision) -> dict:
    """Build an action_denied_receipt record from a failed gate check."""
    from datetime import datetime, timezone
    return {
        "schemaVersion": "0.1.0",
        "lookupId": f"osint-passive-{req.lookup_type}-denied",
        "lookupType": req.lookup_type,
        "target": req.target,
        "targetScope": req.target_scope or "MISSING",
        "engagementPolicyRef": req.engagement_policy_ref or "MISSING",
        "authorizationRef": req.authorization_ref or "MISSING",
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": "no_external_contact",
        "sourceEvidenceRef": "gate_enforcer",
        "operatorIdentityRef": req.operator_identity_ref or "MISSING",
        "receiptRequired": True,
        "fixtureMode": req.fixture_mode,
        "result": {
            "status": decision.denial_reason.value if decision.denial_reason else "denied",
            "records": [],
            "confidenceCaveat": "Lookup was denied by EngagementPolicy gate before any external contact.",
        },
        "receiptEmitted": True,
        "queriedAt": datetime.now(timezone.utc).isoformat(),
        "actionDeniedReceipt": decision.denial_reason.value if decision.denial_reason else "denied",
        "denialMessage": decision.denial_message,
    }
