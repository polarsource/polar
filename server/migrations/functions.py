# PostgreSQL functions that are applied, that needs to be both migrated and recreated
# in our tests.

SEQUENCE_CREATE_CUSTOMER_SHORT_ID = "CREATE SEQUENCE customer_short_id_seq START 1;"

# ID generation algorithm based on https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c
FUNCTION_GENERATE_CUSTOMER_SHORT_ID = """
CREATE OR REPLACE FUNCTION generate_customer_short_id(creation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp())
RETURNS bigint AS $$
DECLARE
    our_epoch bigint := 1672531200000; -- 2023-01-01 in milliseconds
    seq_id bigint;
    now_millis bigint;
    result bigint;
BEGIN
    -- Get sequence number modulo 1024 (10 bits)
    SELECT nextval('customer_short_id_seq') % 1024 INTO seq_id;

    -- Use provided timestamp (defaults to clock_timestamp())
    SELECT FLOOR(EXTRACT(EPOCH FROM creation_timestamp) * 1000) INTO now_millis;

    -- 42 bits timestamp (milliseconds) | 10 bits sequence = 52 bits total
    -- Capacity: 1,024 IDs per millisecond (over 1 million per second)
    -- Combine: (timestamp - epoch) << 10 | sequence
    result := (now_millis - our_epoch) << 10;
    result := result | seq_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;
"""
