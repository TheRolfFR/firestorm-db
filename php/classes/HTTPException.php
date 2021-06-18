<?php

class HTTPException extends Exception
{
  // Redéfinissez l'exception ainsi le message n'est pas facultatif
  public function __construct($message, $code = 0, Throwable $previous = null) {
    $type_message = gettype($message);

    if($type_message != 'string')
      throw new Exception("Incorrect message type for HTTPException constructor, expected string, got " . $type_message);

    $type_code = gettype($code);
    if($type_code != 'integer')
      throw new Exception("Incorrect code type for HTTPException constructor, expected string, got " . $type_code);

    // traitement personnalisé que vous voulez réaliser ...

    // assurez-vous que tout a été assigné proprement
    parent::__construct($message, $code, $previous);
  }

  // chaîne personnalisée représentant l'objet
  public function __toString() {
    return __CLASS__ . ": [{$this->code}]: {$this->message}\n";
  }
}