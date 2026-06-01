FROM mysql:8.0

ENV TZ=Asia/Seoul
ENV MYSQL_ROOT_PASSWORD=13071308
ENV MYSQL_DATABASE=study

COPY ./conf /etc/mysql/conf.d/
COPY init.sql /docker-entrypoint-initdb.d/
