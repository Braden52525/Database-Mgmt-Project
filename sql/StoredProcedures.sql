-- Existing function: book_flight
CREATE OR REPLACE FUNCTION book_flight(
    p_seatNumber VARCHAR,
    p_flightId INT,
    p_passengerId INT,
    p_classId INT
) RETURNS INTEGER AS $$
DECLARE
    v_seatsAvailable INT;
    v_ticketNumber INTEGER;
BEGIN
    -- Lock the flight row to ensure an accurate seat count
    SELECT SeatsAvailable 
      INTO v_seatsAvailable 
      FROM Flight 
     WHERE FlightId = p_flightId
     FOR UPDATE;
    
    IF v_seatsAvailable <= 0 THEN
        RAISE EXCEPTION 'No seats available for flight %', p_flightId;
    END IF;
    
    -- Insert the new ticket and return its TicketNumber
    INSERT INTO Ticket (SeatNumber, FlightId, PassengerId, ClassId)
    VALUES (p_seatNumber, p_flightId, p_passengerId, p_classId)
    RETURNING TicketNumber INTO v_ticketNumber;
    
    -- Decrement the number of available seats
    UPDATE Flight
       SET SeatsAvailable = SeatsAvailable - 1
     WHERE FlightId = p_flightId;
    
    RETURN v_ticketNumber;
END;
$$ LANGUAGE plpgsql;


-- Existing function: process_payment
CREATE OR REPLACE FUNCTION process_payment(
    p_amount DECIMAL,
    p_status VARCHAR,
    p_paymentMethod VARCHAR,
    p_passengerId INT,
    p_ticketNumber INT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO Payment (Amount, Status, PaymentMethod, PassengerId, TicketNumber)
    VALUES (p_amount, p_status, p_paymentMethod, p_passengerId, p_ticketNumber);
END;
$$ LANGUAGE plpgsql;


-- New Combined Function: book_and_pay_flight
-- This function calls book_flight to insert a ticket and then processes the payment.
CREATE OR REPLACE FUNCTION book_and_pay_flight(
    p_seatNumber VARCHAR,
    p_flightId INT,
    p_passengerId INT,
    p_classId INT,
    p_amount DECIMAL,
    p_status VARCHAR,
    p_paymentMethod VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_ticketNumber INTEGER;
BEGIN
    -- Book the flight (ticket insertion and seat decrement)
    v_ticketNumber := book_flight(p_seatNumber, p_flightId, p_passengerId, p_classId);
    
    -- Process the payment for the ticket
    PERFORM process_payment(p_amount, p_status, p_paymentMethod, p_passengerId, v_ticketNumber);
    
    RETURN v_ticketNumber;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;


-- New Function: cancel_ticket
-- This function handles ticket cancellation by updating the payment status and deleting the ticket.
CREATE OR REPLACE FUNCTION cancel_ticket(
    p_ticketNumber INT,
    p_refundAmount DECIMAL,
    p_changedBy VARCHAR  -- If you want to record who cancelled the ticket
) RETURNS VOID AS $$
DECLARE
    v_flightId INT;
BEGIN
    -- Retrieve the flight ID associated with the ticket
    SELECT FlightId INTO v_flightId FROM Ticket WHERE TicketNumber = p_ticketNumber;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket % not found', p_ticketNumber;
    END IF;

    -- Optionally, update the payment status to indicate a refund
    UPDATE Payment 
       SET Status = 'Refunded', Amount = p_refundAmount
     WHERE TicketNumber = p_ticketNumber;

    -- Delete the ticket (this will trigger the seat increment trigger)
    DELETE FROM Ticket WHERE TicketNumber = p_ticketNumber;

    -- Optionally, if an AuditLog table exists, you could log the cancellation here:
    -- INSERT INTO AuditLog (TableName, Operation, RecordId, ChangedBy)
    -- VALUES ('Ticket', 'CANCEL', p_ticketNumber, p_changedBy);
END;
$$ LANGUAGE plpgsql;
