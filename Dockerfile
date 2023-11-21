FROM php:7.4-apache

# hide Apache version and details
RUN echo '\n\
ServerTokens Prod\n\
ServerSignature Off\n'\
>> /etc/apache2/apache2.conf

# Copy host configuration
COPY docker/vhost.conf /etc/apache2/sites-available/000-default.conf

# Copy source code
COPY src/php/ /var/www/html
