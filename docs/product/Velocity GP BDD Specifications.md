# Velocity GP: Master BDD Specifications (v8.2)

**Project:** Velocity GP (Multi-Day Endurance Event)

**Status:** Complete - Admin Operations Console Expansion

**Date:** April 2026

## Purpose

This document is now the index for the Velocity GP business behavior specs. The detailed scenarios have been split into persona-specific files under `docs/product/persona/` so each audience can review its own responsibilities and flows more easily.

## Persona Specifications

1. [Persona 1: The Player (Event Attendee)](./persona/player-event-attendee.md)
2. [Persona 2: The Helios Player (App Creator / Player)](./persona/helios-player-app-creator.md)
3. [Persona 3: The Admin (Event Organizer)](./persona/admin-event-organizer.md)
4. [Persona 4: The System (Backend / Sync)](./persona/system-backend-sync.md)
5. [Persona 5: The Display Board (Venue Visuals)](./persona/display-board-venue-visuals.md)
6. [Persona 6: The Gen AI Announcer (Virtual Commentator)](./persona/gen-ai-announcer.md)

## Reading Guide

- Start with Persona 1 for the core attendee experience and the main race loop.
- Review Persona 2 for Helios-specific rescue rules and fairness constraints.
- Use Persona 3 for organizer workflows across race control, QR operations, team and player review, and event statistics.
- Use Persona 4 for backend rules, state transitions, and sync behavior.
- Use Persona 5 for venue display requirements.
- Use Persona 6 for AI-driven commentary and recap behavior.

## Notes

- Treat these persona files as the source of truth for feature behavior until superseded by a newer version.
- If a feature spans multiple actors, update each affected persona file rather than reintroducing a single monolithic spec.
