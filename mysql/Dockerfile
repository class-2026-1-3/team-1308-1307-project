FROM mysql:8.0

ENV TZ=Asia/Seoul

COPY ./conf /etc/mysql/conf.d/
COPY init.sql /docker-entrypoint-initdb.d/
