# PostgreSQL functions that are applied, that needs to be both migrated and recreated
# in our tests.

SEQUENCE_CREATE_CUSTOMER_SHORT_ID = "CREATE SEQUENCE customer_short_id_seq START 1;"

FUNCTION_GENERATE_CUSTOMER_SHORT_ID = """
CREATE OR REPLACE FUNCTION generate_customer_short_id()
RETURNS bigint AS $$
DECLARE
    our_epoch bigint := 1672531200000; -- 2023-01-01 in milliseconds
    seq_id bigint;
    now_millis bigint;
    result bigint;
BEGIN
    -- Get sequence number modulo 1024 (10 bits)
    SELECT nextval('customer_short_id_seq') % 1024 INTO seq_id;

    -- Get current timestamp in milliseconds
    SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000) INTO now_millis;

    -- Combine: (timestamp - epoch) << 10 | sequence
    -- This gives us timestamp in the high bits, sequence in the low 10 bits
    result := (now_millis - our_epoch) << 10;
    result := result | seq_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;
"""
