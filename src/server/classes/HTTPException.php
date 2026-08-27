<?php

/** Represents an expected client-visible failure that endpoint handlers convert into an HTTP response. */
class HTTPException extends Exception {
    /** Captures an HTTP status and safe response message for request validation failures. */
    public function __construct(string $message, int $code = 400, ?Throwable $previous = null) {
        // assign everything
        parent::__construct($message, $code, $previous);
    }

    /** Formats the exception for server logs without changing its HTTP response payload. */
    public function __toString(): string {
        return __CLASS__ . ": [{$this->code}]: {$this->message}\n";
    }
}
