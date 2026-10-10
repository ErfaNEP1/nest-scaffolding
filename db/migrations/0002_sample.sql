-- Migration: 0002_sample
-- Purpose:   Table of the removable sample module (src/modules/sample).
-- Author:    template
-- Date:      2026-10-10
--
-- Delete this file together with the sample module (docs/guides/removing-the-sample-module.md)
-- before the first deployment. After that, drop the table in a new migration instead.

CREATE TABLE samples (
  id           uuid        PRIMARY KEY,
  owner_id     text        NOT NULL,
  name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description  text,
  status       text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processed')),
  row_version  integer     NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Keyset pagination of a user's samples, newest first.
CREATE INDEX samples_owner_id_created_at_id_idx ON samples (owner_id, created_at DESC, id DESC);
-- Keyset pagination across all owners (admins).
CREATE INDEX samples_created_at_id_idx ON samples (created_at DESC, id DESC);
