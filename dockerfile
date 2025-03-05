FROM php:8.2-apache

# hide Apache version and details
RUN echo '\n\
ServerName localhost\n\
ServerTokens Prod\n\
ServerSignature Off\n'\
>> /etc/apache2/apache2.conf

# Enable mod_rewrite
RUN a2enmod rewrite

# Copy host configuration
COPY docker/vhost.conf /etc/apache2/sites-available/000-default.conf

# Copy source code
COPY php/ /var/www/html
