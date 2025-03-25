-- Trigger Function for Ticket Deletion:
CREATE OR REPLACE FUNCTION update_seats_on_ticket_delete()
RETURNS trigger AS $$
BEGIN
    UPDATE Flight 
       SET SeatsAvailable = SeatsAvailable + 1
     WHERE FlightId = OLD.FlightId;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger Definition:
CREATE TRIGGER trigger_update_seats_after_ticket_delete
AFTER DELETE ON Ticket
FOR EACH ROW
EXECUTE FUNCTION update_seats_on_ticket_delete();
