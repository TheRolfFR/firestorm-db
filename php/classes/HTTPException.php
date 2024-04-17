<?php

class HTTPException extends Exception {
    // custom message
    public function __construct($message, $code = 400, Throwable $previous = null) {
        $type_message = gettype($message);

        if ($type_message != 'string')
            throw new Exception("Incorrect message type for HTTPException constructor, expected string, got " . $type_message);

        $type_code = gettype($code);
        if ($type_code != 'integer')
            throw new Exception("Incorrect code type for HTTPException constructor, expected string, got " . $type_code);

        // assign everything
        parent::__construct($message, $code, $previous);
    }

    // prettier representation
    public function __toString() {
        return __CLASS__ . ": [{$this->code}]: {$this->message}\n";
    }
}