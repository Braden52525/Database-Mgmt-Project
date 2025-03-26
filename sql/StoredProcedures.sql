-- Updated function: book_flight
CREATE OR REPLACE FUNCTION book_flight(
    p_seatNumber VARCHAR,
    p_flightId INT,
    p_passengerId INT,
    p_classType VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_seatsAvailable INT;
    v_ticketNumber INTEGER;
BEGIN
    -- Lock the FlightClass row to ensure an accurate seat count for the selected class
    SELECT SeatsAvailable 
      INTO v_seatsAvailable 
      FROM FlightClass 
     WHERE FlightId = p_flightId
       AND ClassType = p_classType
     FOR UPDATE;
    
    IF v_seatsAvailable <= 0 THEN
        RAISE EXCEPTION 'No seats available for flight % in class %', p_flightId, p_classType;
    END IF;
    
    -- Insert the new ticket (using ClassType) and return its TicketNumber
    INSERT INTO Ticket (SeatNumber, FlightId, PassengerId, ClassType)
    VALUES (p_seatNumber, p_flightId, p_passengerId, p_classType)
    RETURNING TicketNumber INTO v_ticketNumber;
    
    -- Decrement the available seats for that class in the FlightClass table
    UPDATE FlightClass
       SET SeatsAvailable = SeatsAvailable - 1
     WHERE FlightId = p_flightId
       AND ClassType = p_classType;
    
    RETURN v_ticketNumber;
END;
$$ LANGUAGE plpgsql;


-- Existing function: process_payment (remains unchanged)
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


-- Updated Combined Function: book_and_pay_flight
-- This function calls book_flight to insert a ticket (using classType) and then processes the payment.
CREATE OR REPLACE FUNCTION book_and_pay_flight(
    p_seatNumber VARCHAR,
    p_flightId INT,
    p_passengerId INT,
    p_classType VARCHAR,
    p_amount DECIMAL,
    p_status VARCHAR,
    p_paymentMethod VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_ticketNumber INTEGER;
BEGIN
    -- Book the flight (ticket insertion and seat decrement)
    v_ticketNumber := book_flight(p_seatNumber, p_flightId, p_passengerId, p_classType);
    
    -- Process the payment for the ticket
    PERFORM process_payment(p_amount, p_status, p_paymentMethod, p_passengerId, v_ticketNumber);
    
    RETURN v_ticketNumber;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;


-- Function: cancel_ticket
-- This function handles ticket cancellation by updating the payment status and deleting the ticket.
CREATE OR REPLACE FUNCTION cancel_ticket(
    p_ticketNumber INT,
    p_refundAmount DECIMAL,
    p_changedBy VARCHAR  -- Optional: record who cancelled the ticket
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

    -- Delete the ticket (the trigger on Ticket will update available seats accordingly)
    DELETE FROM Ticket WHERE TicketNumber = p_ticketNumber;

    -- Optionally, insert an audit record into AuditLog here.
END;
$$ LANGUAGE plpgsql;
