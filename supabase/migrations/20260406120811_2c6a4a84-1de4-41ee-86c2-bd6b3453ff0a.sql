
-- Delete duplicate [ТЕЛЕ 2] items, keep the oldest one (9351b0aa)
DELETE FROM protocol_items WHERE id IN ('34308f37-eb3e-4b58-bf09-e80fa4d6aa5a', '4df4b858-d67d-4122-809a-3869186545cf');

-- Delete duplicate [World Class] items, keep the oldest one (8b0a1b96)
DELETE FROM protocol_items WHERE id IN ('e71936f3-9e33-4505-9624-f33e5fa096ca', 'd5300612-9a38-4980-b416-9fecb237b226');
